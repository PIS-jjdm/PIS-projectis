package org.pis.project.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import org.pis.project.entities.TeamMemberEntity;

public interface TeamMemberRepository extends JpaRepository<TeamMemberEntity, Integer> {

}
