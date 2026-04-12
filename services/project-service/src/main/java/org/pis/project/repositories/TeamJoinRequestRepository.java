package org.pis.project.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

import org.pis.project.entities.TeamJoinRequestEntity;

public interface TeamJoinRequestRepository extends JpaRepository<TeamJoinRequestEntity, UUID> {

}
