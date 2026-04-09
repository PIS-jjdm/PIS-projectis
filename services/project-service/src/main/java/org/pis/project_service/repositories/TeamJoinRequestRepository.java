package org.pis.project_service.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import org.pis.project_service.models.entities.TeamJoinRequest;

public interface TeamJoinRequestRepository extends JpaRepository<TeamJoinRequest, Integer> {

}
