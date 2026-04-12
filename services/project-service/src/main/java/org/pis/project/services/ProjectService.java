package org.pis.project.services;

import java.util.List;
import java.util.UUID;

import org.pis.project.entities.ProjectEntity;
import org.pis.project.exceptions.ResourceNotFoundException;
import org.pis.project.mappers.ProjectMapper;
import org.pis.project.repositories.ProjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class ProjectService {
    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ProjectMapper projectMapper;

    public List<ProjectEntity> listProjects(String subjectId) {
        return projectRepository.findBySubjectId(subjectId);
    }

    public ProjectEntity getProject(UUID id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + id));
    }

    public ProjectEntity createProject(ProjectEntity project) {
        project.setId(null);
        return projectRepository.save(project);
    }

    public ProjectEntity updateProject(ProjectEntity projectUpdated) {
        ProjectEntity existingProject = getProject(projectUpdated.getId());
        projectMapper.updateEntityFromRequest(projectUpdated, existingProject);
        return projectRepository.save(existingProject);
    }

    public ProjectEntity deleteProject(UUID project_id) {
        ProjectEntity project = getProject(project_id);
        projectRepository.delete(project);
        return project;
    }
}
