package org.pis.project.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import org.pis.project.entities.TeamJoinRequestEntity;

public interface TeamJoinRequestRepository extends JpaRepository<TeamJoinRequestEntity, Integer> {

}
