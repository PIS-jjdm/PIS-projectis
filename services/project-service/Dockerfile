FROM eclipse-temurin:25-jdk-jammy AS build
WORKDIR /app

COPY services/project-service/.mvn/     services/project-service/.mvn/
COPY services/project-service/mvnw      services/project-service/mvnw
COPY services/project-service/pom.xml   services/project-service/pom.xml

RUN chmod +x services/project-service/mvnw

COPY proto/ ./proto/

WORKDIR /app/services/project-service

RUN ./mvnw dependency:go-offline -B

COPY services/project-service/src/ ./src

RUN ./mvnw clean package -DskipTests

FROM eclipse-temurin:25-jdk-jammy
WORKDIR /app

COPY --from=build /app/services/project-service/target/*.jar app.jar

EXPOSE 50054

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
