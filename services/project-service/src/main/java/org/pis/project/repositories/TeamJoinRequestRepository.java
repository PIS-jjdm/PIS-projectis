package org.pis.project.repositories;

import java.util.List;
import java.util.UUID;

import org.pis.project.entities.TeamJoinRequestEntity;
import org.pis.project.entities.enums.JoinRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TeamJoinRequestRepository extends JpaRepository<TeamJoinRequestEntity, UUID> {
  List<TeamJoinRequestEntity> findByTeamId(UUID teamId);

  List<TeamJoinRequestEntity> findByRequestorStudentId(String studentId);

  List<TeamJoinRequestEntity> findByStatus(JoinRequestStatus status);

  @Modifying
  @Query("""
          UPDATE TeamJoinRequestEntity r
          SET r.status = JoinRequestStatus.CANCELED
          WHERE r.requestorStudentId = :requestorStudentId
            AND r.projectId = :projectId
            AND r.status = JoinRequestStatus.PENDING
      """)
  void cancelPendingRequestsForStudentInProject(
      @Param("requestorStudentId") String requestorStudentId,
      @Param("projectId") UUID projectId);
}
