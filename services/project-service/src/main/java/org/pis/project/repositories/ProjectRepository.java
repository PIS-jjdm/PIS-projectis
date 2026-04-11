package org.pis.project.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import org.pis.project.entities.ProjectEntity;

public interface ProjectRepository extends JpaRepository<ProjectEntity, Integer> {

}
