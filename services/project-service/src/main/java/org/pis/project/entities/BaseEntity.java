package org.pis.project.entities;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@MappedSuperclass
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public abstract class BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAtUtc;

    @PrePersist
    protected void onCreate() {
        if (this.createdAtUtc == null) {
            this.createdAtUtc = LocalDateTime.now(ZoneOffset.UTC);
        }
    }
}