package org.pis.project.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import org.pis.project.entities.TeamEntity;

public interface TeamRepository extends JpaRepository<TeamEntity, Integer> {

}
