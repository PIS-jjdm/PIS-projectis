# ---- BUILD STAGE ----
FROM eclipse-temurin:25-jdk-jammy AS build
WORKDIR /app

COPY . .

RUN chmod +x mvnw
RUN ./mvnw clean package -DskipTests

# ---- RUNTIME ----
FROM eclipse-temurin:25-jdk-jammy
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

ENTRYPOINT ["java","-jar","/app/app.jar"]