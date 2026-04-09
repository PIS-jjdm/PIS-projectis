package org.pis.project_service.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import org.pis.project_service.models.entities.Team;

public interface TeamRepository extends JpaRepository<Team, Integer> {

}
