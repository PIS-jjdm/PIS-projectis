FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

RUN apt-get update \
    && apt-get install -y --no-install-recommends protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

COPY proto /src/proto
COPY services/subject-service-dotnet /src/services/subject-service-dotnet

WORKDIR /src/services/subject-service-dotnet/SubjectService.App
RUN dotnet restore SubjectService.App.csproj
RUN dotnet publish SubjectService.App.csproj -c Release -o /app/publish -p:Protobuf_ProtocFullPath=/usr/bin/protoc

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 50053
ENTRYPOINT ["dotnet", "SubjectService.App.dll"]
