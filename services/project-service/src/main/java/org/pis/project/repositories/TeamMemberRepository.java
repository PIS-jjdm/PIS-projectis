package org.pis.project.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

import org.pis.project.entities.TeamMemberEntity;

public interface TeamMemberRepository extends JpaRepository<TeamMemberEntity, UUID> {
    boolean existsByStudentIdAndProjectId(String studentId, UUID projectId);

    boolean existsByStudentIdAndTeamId(String studentId, UUID teamId);

    Optional<TeamMemberEntity> findByStudentIdAndTeamId(String studentId, UUID teamId);

    Integer countByTeamId(UUID teamId);

}
