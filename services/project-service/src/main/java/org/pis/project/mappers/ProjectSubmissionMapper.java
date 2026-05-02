package org.pis.project.mappers;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;
import org.pis.project.entities.ProjectSubmissionEntity;
import org.pis.project.proto.ProjectSubmission;

@Mapper(componentModel = "spring", uses = CommonMapper.class, unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface ProjectSubmissionMapper {

    @Mapping(target = "teamId", source = "team.id")
    @Mapping(target = "fileName", source = "fileName")
    @Mapping(target = "contentType", source = "contentType")
    @Mapping(target = "fileSize", source = "fileSize")
    ProjectSubmission toProto(ProjectSubmissionEntity entity);
}
