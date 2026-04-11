package org.pis.project.services;

import java.util.List;

import org.pis.project.entities.ProjectEntity;
import org.pis.project.repositories.ProjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class ProjectService {
    @Autowired
    private ProjectRepository projectRepository;

    public List<ProjectEntity> getAllProjects() {
        return projectRepository.findAll();
    }

    public ProjectEntity getProjectById(Integer id) {
        return projectRepository.findById(id).orElse(null);
    }

    public ProjectEntity createProject(ProjectEntity project) {
        return projectRepository.save(project);
    }

    public void deleteProject(Integer id) {
        projectRepository.deleteById(id);
    }
}
