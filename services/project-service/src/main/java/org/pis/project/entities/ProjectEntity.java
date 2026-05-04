package org.pis.project.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;
import java.util.List;

import org.pis.project.exceptions.BusinessRuleViolationException;

@Entity
@Table(name = "project")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class ProjectEntity extends BaseEntity {

    @Column(nullable = false)
    private String title;

    private String description;

    @Column(nullable = false)
    private String teacherId;

    @Column(nullable = false)
    private Integer maxStudentsPerTeam;

    @Column(nullable = false, columnDefinition = "BIGINT NOT NULL DEFAULT 10485760")
    private Long submissionSizeLimit;

    @Column(nullable = false)
    private LocalDateTime startDate;

    @Column(nullable = false)
    private LocalDateTime endDate;

    @Column(nullable = false)
    private String subjectId;

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TeamEntity> teams;

    public void validateDates() {
        if (startDate.isAfter(endDate)) {
            throw new BusinessRuleViolationException(
                    "Project start date must be before end date");
        }
    }
}
