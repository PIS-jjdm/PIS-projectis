package org.pis.project.repositories;

import java.util.Optional;
import java.util.UUID;

import org.pis.project.entities.ProjectSubmissionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectSubmissionRepository
        extends JpaRepository<ProjectSubmissionEntity, UUID> {

    Optional<ProjectSubmissionEntity> findByTeamId(UUID teamId);

    boolean existsByTeamId(UUID teamId);

    void deleteByTeamId(UUID teamId);
}
