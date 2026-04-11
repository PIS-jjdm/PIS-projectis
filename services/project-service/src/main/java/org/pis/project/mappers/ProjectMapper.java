package org.pis.project.mappers;

import org.mapstruct.BeanMapping;
import org.mapstruct.CollectionMappingStrategy;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;
import org.pis.project.entities.ProjectEntity;
import org.pis.project.proto.CreateProjectRequest;
import org.pis.project.proto.Project;
import org.pis.project.proto.UpdateProjectRequest;

@Mapper(componentModel = "spring", uses = CommonMapper.class, collectionMappingStrategy = CollectionMappingStrategy.ADDER_PREFERRED)
public interface ProjectMapper {

    @Mapping(target = "projectId", source = "id")
    Project toProto(ProjectEntity entity);

    @Mapping(target = "id", ignore = true)
    ProjectEntity toEntity(CreateProjectRequest proto);

    @Mapping(target = "id", source = "projectId")
    ProjectEntity toEntity(UpdateProjectRequest proto);

    @Mapping(target = "id", ignore = true) // Usually ignore ID during merge
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateEntityFromRequest(ProjectEntity source, @MappingTarget ProjectEntity target);
}