package org.pis.project.mappers;

import java.util.List;

import org.mapstruct.BeanMapping;
import org.mapstruct.CollectionMappingStrategy;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;
import org.mapstruct.ReportingPolicy;
import org.pis.project.entities.ProjectEntity;
import org.pis.project.proto.CreateProjectRequest;
import org.pis.project.proto.Project;
import org.pis.project.proto.UpdateProjectRequest;

@Mapper(componentModel = "spring", uses = CommonMapper.class, collectionMappingStrategy = CollectionMappingStrategy.ADDER_PREFERRED, unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface ProjectMapper {

    @Mapping(target = "projectId", source = "id")
    Project toProto(ProjectEntity entity);

    List<Project> toProtoList(List<ProjectEntity> entities);

    @Mapping(target = "id", ignore = true)
    ProjectEntity toEntity(CreateProjectRequest proto);

    @Mapping(target = "id", source = "projectId")
    ProjectEntity toEntity(UpdateProjectRequest proto);

    @Mapping(target = "id", ignore = true)
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateEntityFromRequest(ProjectEntity source, @MappingTarget ProjectEntity target);
}
