package org.pis.project.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

import org.pis.project.entities.TeamMemberEntity;

public interface TeamMemberRepository extends JpaRepository<TeamMemberEntity, UUID> {
}
