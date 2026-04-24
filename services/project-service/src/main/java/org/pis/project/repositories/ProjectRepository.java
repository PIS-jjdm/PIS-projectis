package org.pis.project.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

import org.pis.project.entities.ProjectEntity;

public interface ProjectRepository extends JpaRepository<ProjectEntity, UUID> {
    List<ProjectEntity> findBySubjectId(String subjectId);
}
