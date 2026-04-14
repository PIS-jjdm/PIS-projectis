package org.pis.project.repositories;

import java.util.List;
import java.util.UUID;

import org.pis.project.entities.TeamEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamRepository extends JpaRepository<TeamEntity, UUID> {

    List<TeamEntity> findByProjectId(UUID projectId);
}
