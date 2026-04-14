package org.pis.project.entities;

import java.time.LocalDateTime;
import java.util.UUID;

import org.pis.project.entities.enums.JoinRequestStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinColumns;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "team_join_request")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class TeamJoinRequestEntity extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private JoinRequestStatus status;

    @Column(nullable = false)
    private String requestorStudentId;

    private LocalDateTime resolvedAtUtc;

    private UUID projectId;

    @ManyToOne(fetch = jakarta.persistence.FetchType.LAZY)
    @JoinColumns({
            @JoinColumn(name = "team_id", referencedColumnName = "id")
    })
    private TeamEntity team;
}