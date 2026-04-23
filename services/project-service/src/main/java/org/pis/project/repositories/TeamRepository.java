package org.pis.project.repositories;

import java.util.List;
import java.util.UUID;

import org.pis.project.entities.TeamEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TeamRepository extends JpaRepository<TeamEntity, UUID> {

    List<TeamEntity> findByProjectId(UUID projectId);

    @Query("""
                SELECT t, COUNT(m)
                FROM TeamEntity t
                LEFT JOIN t.members m
                WHERE t.project.id = :projectId
                GROUP BY t
            """)
    List<Object[]> findTeamsWithMemberCount(UUID projectId);

}
