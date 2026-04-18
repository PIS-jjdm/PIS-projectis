package org.pis.project.mappers;

import java.util.List;

import org.mapstruct.CollectionMappingStrategy;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;
import org.pis.project.entities.TeamEntity;
import org.pis.project.entities.TeamMemberEntity;
import org.pis.project.proto.ListTeam;
import org.pis.project.proto.RegisterTeamRequest;
import org.pis.project.proto.Team;

@Mapper(componentModel = "spring", uses = CommonMapper.class, collectionMappingStrategy = CollectionMappingStrategy.ADDER_PREFERRED, unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface TeamMapper {

    @Mapping(target = "teamId", source = "id")
    @Mapping(target = "projectId", source = "project.id") // Unwraps the ProjectEntity to get its ID
    @Mapping(target = "studentIdsList", source = "members") // Protobuf 'repeated' fields map to '...List'
    Team toProto(TeamEntity entity);

    @Mapping(target = "teamId", source = "id")
    @Mapping(target = "projectId", source = "project.id")
    ListTeam toProtoList(TeamEntity entity);

    List<Team> toProtoList(List<TeamEntity> entities);

    List<ListTeam> toListProtoList(List<TeamEntity> entities);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "name", source = "teamName")
    @Mapping(target = "leaderStudentId", source = "creatorStudentId")
    @Mapping(target = "project", ignore = true)
    TeamEntity toEntity(RegisterTeamRequest registerTeamRequest);

    default String mapTeamMemberToStudentId(TeamMemberEntity member) {
        if (member == null) {
            return null;
        }
        return member.getStudentId();
    }
}
