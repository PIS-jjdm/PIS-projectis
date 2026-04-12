package org.pis.project.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

import org.pis.project.entities.TeamEntity;

public interface TeamRepository extends JpaRepository<TeamEntity, UUID> {

    List<TeamEntity> findByProjectId(UUID projectId);


}
