package org.pis.project.grpc;

import org.pis.project.proto.ProjectServiceGrpc;
import org.pis.project.services.ProjectService;
import org.pis.project.services.TeamJoinRequestService;
import org.pis.project.services.TeamMemberService;
import org.pis.project.services.TeamService;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ProjectGrpcService extends ProjectServiceGrpc.ProjectServiceImplBase {

  private final ProjectService projectService;
  private final TeamService teamService; 
  private final TeamMemberService teamMemberService; 
  private final TeamJoinRequestService teamJoinRequestService; 
}