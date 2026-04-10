package org.pis.project.services;

import java.util.List;

import org.pis.project.models.entities.TeamMember;
import org.pis.project.repositories.TeamMemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class TeamMemberService {
    @Autowired
    private TeamMemberRepository teamMemberRepository;

    public List<TeamMember> TeamMembers() {
        return teamMemberRepository.findAll();
    }

    public TeamMember TeamMemberById(Integer id) {
        return teamMemberRepository.findById(id).orElse(null);
    }

    public TeamMember TeamMember(TeamMember TeamMember) {
        return teamMemberRepository.save(TeamMember);
    }

    public void TeamMember(Integer id) {
        teamMemberRepository.deleteById(id);
    }
}
