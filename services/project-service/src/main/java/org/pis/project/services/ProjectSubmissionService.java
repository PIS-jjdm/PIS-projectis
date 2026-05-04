package org.pis.project.services;

import java.util.UUID;

import org.pis.project.entities.ProjectEntity;
import org.pis.project.entities.ProjectSubmissionEntity;
import org.pis.project.entities.TeamEntity;
import org.pis.project.exceptions.BusinessRuleViolationException;
import org.pis.project.exceptions.ResourceNotFoundException;
import org.pis.project.repositories.ProjectSubmissionRepository;
import org.pis.project.repositories.TeamRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProjectSubmissionService {

    private static final long DEFAULT_SUBMISSION_SIZE_LIMIT = 10L * 1024L * 1024L; // 10 MB

    private final ProjectSubmissionRepository submissionRepository;
    private final TeamRepository teamRepository;

    @Transactional
    public ProjectSubmissionEntity submit(UUID teamId, byte[] fileData, String fileName,
            String contentType, long fileSize) {
        log.info("Attempting to store submission for team [{}], file [{}]", teamId, fileName);

        TeamEntity team = teamRepository.findById(teamId)
                .orElseThrow(() -> {
                    log.error("Team not found with id: [{}]", teamId);
                    return new ResourceNotFoundException("Team not found with id: " + teamId);
                });

        if (fileData == null) {
            throw new BusinessRuleViolationException("Submission file is empty");
        }
        if (fileName == null || fileName.isBlank()) {
            throw new BusinessRuleViolationException("Submission file name is required");
        }

        // check submission size limit; null on legacy rows or detached projects
        ProjectEntity project = team.getProject();
        Long limitValue = project != null ? project.getSubmissionSizeLimit() : null;
        long maxSubmissionSize = (limitValue == null || limitValue <= 0L)
                ? DEFAULT_SUBMISSION_SIZE_LIMIT
                : limitValue;
        if (fileSize > maxSubmissionSize) {
            log.error("File size [{}] bytes exceeds project limit [{}] bytes for team [{}]",
                    fileSize, maxSubmissionSize, teamId);
            throw new BusinessRuleViolationException(
                    String.format("File size %.2f MB exceeds the project limit of %.2f MB",
                            fileSize / (1024.0 * 1024.0),
                            maxSubmissionSize / (1024.0 * 1024.0)));
        }

        String resolvedContentType = (contentType == null || contentType.isBlank())
                ? "application/octet-stream"
                : contentType;

        // Replace old submission if exists
        submissionRepository.findByTeamId(teamId).ifPresent(existing -> {
            log.info("Replacing existing submission [{}] for team [{}]", existing.getId(), teamId);
            submissionRepository.delete(existing);
            submissionRepository.flush();
        });

        ProjectSubmissionEntity submission = ProjectSubmissionEntity.builder()
                .fileName(fileName)
                .contentType(resolvedContentType)
                .fileSize(fileSize)
                .fileData(fileData)
                .team(team)
                .build();

        ProjectSubmissionEntity saved = submissionRepository.save(submission);
        log.info("Successfully stored submission [{}] for team [{}]", saved.getId(), teamId);
        return saved;
    }

    @Transactional(readOnly = true)
    public ProjectSubmissionEntity getSubmission(UUID teamId) {
        log.info("Fetching submission for team [{}]", teamId);
        return submissionRepository.findByTeamId(teamId)
                .orElseThrow(() -> {
                    log.error("No submission found for team [{}]", teamId);
                    return new ResourceNotFoundException("No submission found for team: " + teamId);
                });
    }

    @Transactional
    public void deleteSubmission(UUID teamId) {
        log.info("Attempting to delete submission for team [{}]", teamId);

        ProjectSubmissionEntity submission = submissionRepository.findByTeamId(teamId)
                .orElseThrow(() -> {
                    log.error("No submission to delete for team [{}]", teamId);
                    return new ResourceNotFoundException("No submission found for team: " + teamId);
                });

        submissionRepository.delete(submission);
        log.info("Successfully deleted submission [{}] for team [{}]", submission.getId(), teamId);
    }
}
