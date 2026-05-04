package org.pis.project.mappers;

import java.util.List;

import org.mapstruct.BeanMapping;
import org.mapstruct.CollectionMappingStrategy;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.NullValueCheckStrategy;
import org.mapstruct.ReportingPolicy;
import org.pis.project.entities.TeamEntity;
import org.pis.project.entities.TeamMemberEntity;
import org.pis.project.proto.ListTeam;
import org.pis.project.proto.RegisterTeamRequest;
import org.pis.project.proto.Team;
import org.pis.project.proto.TeamDetail;

import auth.Auth.User;
import eval.Eval.ProjectEvaluation;

@Mapper(componentModel = "spring", uses = { CommonMapper.class,
        ProjectSubmissionMapper.class }, collectionMappingStrategy = CollectionMappingStrategy.ADDER_PREFERRED, unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface TeamMapper {

    // ignoreByDefault prevents MapStruct from auto-mapping fields it sees by name match, in
    // particular the destructive copy of evaluation.teamId/projectId/unknownFields/allFields
    // onto the matching TeamDetail fields (which silently corrupted team_id/project_id and
    // wiped students whenever an evaluation was attached). With this flag only the explicit
    // @Mapping targets below are touched.
    //
    // Protobuf message setters reject null, so the optional submission/evaluation also need
    // the ALWAYS null-check so the setter is skipped when the source is absent.
    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "teamId", source = "team.id")
    @Mapping(target = "projectId", source = "team.project.id")
    @Mapping(target = "name", source = "team.name")
    @Mapping(target = "leaderStudentId", source = "team.leaderStudentId")
    @Mapping(target = "studentsList", source = "teamMembers")
    @Mapping(target = "evaluation", source = "evaluation",
            nullValueCheckStrategy = NullValueCheckStrategy.ALWAYS)
    @Mapping(target = "submission", source = "team.projectSubmission",
            nullValueCheckStrategy = NullValueCheckStrategy.ALWAYS)
    TeamDetail toProtoDetail(TeamEntity team, ProjectEvaluation evaluation, List<User> teamMembers);

    @Mapping(target = "teamId", source = "id")
    @Mapping(target = "projectId", source = "project.id")
    @Mapping(target = "studentIdsList", source = "members")
    Team toProto(TeamEntity team);

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
