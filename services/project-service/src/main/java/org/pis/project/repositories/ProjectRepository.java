package org.pis.project.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

import org.pis.project.entities.ProjectEntity;

public interface ProjectRepository extends JpaRepository<ProjectEntity, Long> {
    List<ProjectEntity> findBySubjectId(String subjectId);
}
