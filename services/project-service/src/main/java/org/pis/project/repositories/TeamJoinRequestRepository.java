package org.pis.project.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import org.pis.project.models.entities.TeamJoinRequest;

public interface TeamJoinRequestRepository extends JpaRepository<TeamJoinRequest, Integer> {

}
