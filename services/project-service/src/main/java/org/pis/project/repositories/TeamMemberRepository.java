package org.pis.project.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import org.pis.project.models.entities.TeamMember;

public interface TeamMemberRepository extends JpaRepository<TeamMember, Integer> {

}
