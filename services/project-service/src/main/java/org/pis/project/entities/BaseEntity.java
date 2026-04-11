package org.pis.project.entities;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@MappedSuperclass
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public abstract class BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(nullable = false, updatable = false)
    private Long id;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAtUtc;

    @PrePersist
    protected void onCreate() {
        if (this.createdAtUtc == null) {
            this.createdAtUtc = LocalDateTime.now(ZoneOffset.UTC);
        }
    }
}