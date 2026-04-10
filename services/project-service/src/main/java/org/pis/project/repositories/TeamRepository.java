package org.pis.project.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import org.pis.project.models.entities.Team;

public interface TeamRepository extends JpaRepository<Team, Integer> {

}
