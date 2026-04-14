package org.pis.project.mappers;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.pis.project.domain.JoinRequestFilter;
import org.pis.project.entities.TeamJoinRequestEntity;
import org.pis.project.entities.enums.JoinRequestStatus;
import org.pis.project.proto.CreateJoinRequestRequest;
import org.pis.project.proto.JoinRequest;
import org.pis.project.proto.ListJoinRequestsRequest;

@Mapper(componentModel = "spring", uses = CommonMapper.class)
public interface TeamJoinRequestMapper {

  @Mapping(target = "joinRequestId", source = "id")
  @Mapping(target = "teamId", source = "team.id")
  JoinRequest toProto(TeamJoinRequestEntity entity);

  Iterable<JoinRequest> toProtoList(Iterable<TeamJoinRequestEntity> entities);

  @Mapping(target = "id", ignore = true)
  @Mapping(target = "team", ignore = true) // Team will be set in the service layer based on teamId
  @Mapping(target = "status", ignore = true) // Status will be set to PENDING in the service layer
  TeamJoinRequestEntity toEntity(CreateJoinRequestRequest proto);

  default JoinRequestFilter toFilter(ListJoinRequestsRequest request) {
    String studentId = request.hasRequestorStudentId() ? request.getRequestorStudentId() : null;
    String teamId = request.hasTeamId() ? request.getTeamId() : null;
    JoinRequestStatus status = request.hasStatus() ? JoinRequestStatus.valueOf(request.getStatus().toUpperCase())
        : null;

    return new JoinRequestFilter(studentId, teamId, status);
  }

}