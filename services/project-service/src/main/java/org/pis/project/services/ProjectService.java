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
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
@RequiredArgsConstructor
public class ProjectService {
    private static final long DEFAULT_SUBMISSION_SIZE_LIMIT = 10L * 1024L * 1024L; // 10 MB

    private final ProjectRepository projectRepository;
    private final ProjectMapper projectMapper;

    @Transactional(readOnly = true)
    public List<ProjectEntity> listProjects(String subjectId) {
        return projectRepository.findBySubjectId(subjectId);
    }

    @Transactional(readOnly = true)
    public ProjectEntity getProject(UUID id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> {
                    log.error("Project not found with id: [{}]", id);
                    return new ResourceNotFoundException("Project not found with id: " + id);
                });
    }

    @Transactional
    public ProjectEntity createProject(ProjectEntity project) {
        log.info("Attempting to create new project: [{}]", project.getTitle());

        project.setId(null);
        if (project.getSubmissionSizeLimit() == null || project.getSubmissionSizeLimit() <= 0L) {
            project.setSubmissionSizeLimit(DEFAULT_SUBMISSION_SIZE_LIMIT);
        }
        project.validateDates();

        ProjectEntity savedProject = projectRepository.save(project);
        log.info("Successfully created project [{}] with ID [{}]", savedProject.getTitle(), savedProject.getId());
        return savedProject;
    }

    @Transactional
    public ProjectEntity updateProject(ProjectEntity projectUpdated) {
        log.info("Attempting to update project ID [{}]", projectUpdated.getId());

        ProjectEntity existingProject = getProject(projectUpdated.getId());
        projectMapper.updateEntityFromRequest(projectUpdated, existingProject);

        existingProject.validateDates();

        ProjectEntity savedProject = projectRepository.save(existingProject);
        log.info("Successfully updated project [{}]", savedProject.getId());
        return savedProject;
    }

    @Transactional
    public ProjectEntity deleteProject(UUID project_id) {
        log.info("Attempting to delete project ID [{}]", project_id);

        ProjectEntity project = getProject(project_id);
        projectRepository.delete(project);

        log.info("Successfully deleted project [{}]", project_id);
        return project;
    }
}
