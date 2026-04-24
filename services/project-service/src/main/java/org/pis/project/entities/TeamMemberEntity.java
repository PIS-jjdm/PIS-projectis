package org.pis.project.entities;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinColumns;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "team_member", uniqueConstraints = {
        @UniqueConstraint(columnNames = { "student_id", "project_id" })
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class TeamMemberEntity extends BaseEntity {

    @Column(nullable = false)
    private String studentId;

    @Column(nullable = false)
    private UUID projectId;

    @ManyToOne(fetch = jakarta.persistence.FetchType.LAZY)
    @JoinColumns({
            @JoinColumn(name = "team_id", referencedColumnName = "id")
    })
    private TeamEntity team;
}
