<!--<capability id="valdr.agents.dependency-audit-agent.ecosystem-jvm" pack="valdr" role="workflow">-->
# JVM Ecosystem Audit (Maven / Gradle)

<!--<identity>-->
Full audit workflow for Java, Kotlin, and Scala projects using Maven or Gradle build systems.
<!--</identity>-->

<!--<instructions>-->

## Step 1: Dependency Inventory

### 1a: Identify Build System

| File Present | Build System | Config Format |
|---|---|---|
| `pom.xml` | Maven | XML |
| `build.gradle` | Gradle (Groovy DSL) | Groovy |
| `build.gradle.kts` | Gradle (Kotlin DSL) | Kotlin |
| `settings.gradle(.kts)` | Gradle multi-project | Check `include` for subprojects |

For multi-module projects:
```bash
# Maven — find all pom.xml files
find . -name "pom.xml" -not -path "*/target/*" -maxdepth 3

# Gradle — check settings for included projects
cat settings.gradle.kts 2>/dev/null || cat settings.gradle 2>/dev/null
```

### 1b: Build Dependency List

```bash
# Maven dependency tree
mvn dependency:tree -DoutputType=text 2>/dev/null

# Maven effective POM (shows resolved versions including BOM/parent)
mvn help:effective-pom 2>/dev/null

# Gradle dependencies
./gradlew dependencies 2>/dev/null

# Gradle dependencies for a specific configuration
./gradlew dependencies --configuration runtimeClasspath 2>/dev/null
```

Classify each dependency by scope:

**Maven scopes:**
| Scope | Meaning | Shipped in Release? |
|---|---|---|
| `compile` (default) | Available everywhere | Yes |
| `provided` | Available at compile, supplied by runtime environment | No (e.g., servlet API) |
| `runtime` | Not needed for compilation, needed at runtime | Yes |
| `test` | Test only | No |
| `system` | Like `provided` but from local path | Risky — check the path |

**Gradle configurations:**
| Configuration | Meaning | Shipped in Release? |
|---|---|---|
| `implementation` | Compile + runtime, not exposed to consumers | Yes |
| `api` | Compile + runtime, exposed to consumers | Yes |
| `compileOnly` | Compile only, not in runtime classpath | No |
| `runtimeOnly` | Runtime only, not available at compile time | Yes |
| `testImplementation` | Test compile + runtime | No |
| `annotationProcessor` | Annotation processing at compile time | No |

### 1c: BOM and Version Management

```bash
# Maven — check for dependencyManagement / BOM imports
rg "<dependencyManagement>" pom.xml -A 30
rg "scope>import</scope" pom.xml -B 5

# Gradle — check for platform/BOM declarations
rg "platform\(" build.gradle.kts 2>/dev/null || rg "platform\(" build.gradle 2>/dev/null
rg "enforcedPlatform\(" build.gradle.kts 2>/dev/null
```

BOMs centralize version management — drift in BOM versions can cascade across many dependencies.

## Step 2: Vulnerability Scan

### 2a: Run Audit Tools

```bash
# OWASP Dependency-Check (Maven)
mvn org.owasp:dependency-check-maven:check -DfailBuildOnCVSS=0 2>/dev/null

# OWASP Dependency-Check (Gradle)
./gradlew dependencyCheckAnalyze 2>/dev/null

# Fallback: check against OSV/NVD using GAV coordinates
# Format: groupId:artifactId:version
```

If OWASP dependency-check is not available, fall back to OSV API lookups using Maven coordinates (groupId:artifactId:version) or check GHSA/NVD directly.

### 2b: Capture Advisory Metadata

For each vulnerability found, record:
- **Advisory ID**: CVE-xxxx or GHSA-xxxx
- **GAV coordinate**: `groupId:artifactId:version`
- **Affected range**: vulnerable version range
- **Fixed version**: first patched version
- **CVSS score**: from NVD or advisory
- **Direct or transitive**: declared in project POM/build file, or pulled in by another dependency?

### 2c: Reachability Analysis

JVM reachability is harder than static languages due to reflection, service loaders, and annotation processing:

```bash
# Find direct imports of the vulnerable package
rg "import <package.path>" --type java --type kotlin -l

# Check for reflection/dynamic loading
rg "Class\.forName\(\"<class-name>\"\)" --type java --type kotlin -l
rg "ServiceLoader\.load\(" --type java --type kotlin -l
```

JVM-specific reachability considerations:

| Pattern | Reachability Impact |
|---|---|
| Direct import | Standard reachability — trace the call path |
| Reflection (`Class.forName`) | Potentially reachable — class name may match vulnerable path |
| SPI / ServiceLoader | Automatically loaded if on classpath and declared in `META-INF/services` |
| Annotation processor | Compile-time only — not in runtime classpath |
| `provided` / `compileOnly` scope | Supplied by runtime environment — vulnerability depends on deployed version |
| Spring auto-configuration | Conditionally loaded — check `@ConditionalOn*` annotations |
| Servlet container dependency | Container supplies the implementation — check container version |

Classify reachability: `reachable`, `potentially-reachable`, `unreachable`, `unknown`.

**JVM caution:** Reflection and service loaders make false `unreachable` classifications dangerous. When in doubt, classify as `potentially-reachable` or `unknown`.

### 2d: Adjusted Urgency

Apply the same severity × reachability matrix as other ecosystems. For `provided`/`compileOnly` dependencies, note that the actual vulnerability depends on the runtime environment's version — flag as `environment-dependent`.

## Step 3: Unused Dependency Detection

### 3a: Scan for Usage

```bash
# Find imports from a specific package
rg "import <groupId-package>\." --type java --type kotlin -l

# Check for wildcard imports that may hide usage
rg "import <package>\.\*" --type java --type kotlin -l
```

### 3b: Check Non-Obvious Usage Before Flagging

| Pattern | How to Check | Example |
|---|---|---|
| **Reflection / `Class.forName`** | Search for string references to class names | JDBC drivers loaded by name |
| **SPI / ServiceLoader** | Check `META-INF/services/` directories | Database drivers, logging backends |
| **Annotation processors** | Check `annotationProcessor` / `kapt` configs | Lombok, MapStruct, Dagger |
| **`provided` scope** | Compile-time API, runtime supplies impl | Servlet API, CDI |
| **Spring Boot starters** | Starter brings in auto-configuration | `spring-boot-starter-web` |
| **Test utilities** | Used in test sources only | Should be in `testImplementation` / `test` scope |
| **Plugin dependencies** | Referenced in build plugin configuration | Maven/Gradle plugin deps |
| **Runtime-only** | No compile-time reference, loaded dynamically | Logging implementations (SLF4J backends) |

### 3c: Scope Misplacement

Flag dependencies in the wrong scope:
- Test-only dependency in `compile`/`implementation` → should be `test`/`testImplementation`
- Compile-time-only in `compile` → should be `provided`/`compileOnly`
- Annotation processor in `implementation` → should be `annotationProcessor`

## Step 4: Version Alignment Analysis

### 4a: Detect Drift

For multi-module projects:
```bash
# Maven — compare versions across modules
rg "<artifactId><dep-name></artifactId>" **/pom.xml -A 1

# Gradle — check if version catalog or platform is used consistently
cat gradle/libs.versions.toml 2>/dev/null
```

### 4b: Drift Types

| Type | Description | Severity |
|---|---|---|
| BOM version mismatch | Modules import different BOM versions | High |
| Explicit version overriding BOM | Module declares explicit version that shadows BOM | Medium |
| Version catalog inconsistency | Some modules use catalog, others hardcode versions | Medium |
| Dependency convergence failure | Same artifact at different versions in classpath | High (potential `NoSuchMethodError`) |
| Parent POM version drift | Multi-module parent POM versions not aligned | Medium |

### 4c: Convergence Check

```bash
# Maven dependency convergence
mvn org.apache.maven.plugins:maven-enforcer-plugin:enforce -Drules=dependencyConvergence 2>/dev/null

# Gradle — check for version conflicts
./gradlew dependencyInsight --dependency <artifact-name> 2>/dev/null
```

Convergence failures in JVM are dangerous — they can cause `NoSuchMethodError`, `ClassNotFoundException`, and other runtime failures that don't surface until specific code paths execute.

## Output

After completing all steps, hand off findings to `valdr.agents.dependency-audit-agent.reporting-remediation` for scorecard synthesis and upgrade planning.

## Anti-Patterns (DO NOT)

1. Run `mvn install`, `./gradlew build`, or any build/install command
2. Ignore reflection and ServiceLoader patterns when assessing unused dependencies
3. Flag `provided`/`compileOnly` dependencies as unused — they're compile-time APIs
4. Assume annotation processor dependencies are runtime dependencies
5. Skip BOM/parent POM analysis — version management is often centralized there
6. Classify `provided`-scope vulnerabilities without noting the runtime environment dependency

<!--</instructions>-->
<!--</capability>-->
