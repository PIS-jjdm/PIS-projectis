package org.pis.project.services;

import java.util.List;
import java.util.UUID;

import org.pis.project.entities.ProjectEntity;
import org.pis.project.exceptions.ResourceNotFoundException;
import org.pis.project.mappers.ProjectMapper;
import org.pis.project.repositories.ProjectRepository;
import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ProjectService {
    private final ProjectRepository projectRepository;
    private final ProjectMapper projectMapper;

    @Transactional(readOnly = true)
    public List<ProjectEntity> listProjects(String subjectId) {
        return projectRepository.findBySubjectId(subjectId);
    }

    @Transactional(readOnly = true)
    public ProjectEntity getProject(UUID id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + id));
    }

    @Transactional
    public ProjectEntity createProject(ProjectEntity project) {
        project.setId(null);
        project.validateDates();
        return projectRepository.save(project);
    }

    @Transactional
    public ProjectEntity updateProject(ProjectEntity projectUpdated) {
        ProjectEntity existingProject = getProject(projectUpdated.getId());
        projectMapper.updateEntityFromRequest(projectUpdated, existingProject);

        existingProject.validateDates();

        return projectRepository.save(existingProject);
    }

    @Transactional
    public ProjectEntity deleteProject(UUID project_id) {
        ProjectEntity project = getProject(project_id);
        projectRepository.delete(project);
        return project;
    }
}
