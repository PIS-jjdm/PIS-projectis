package org.pis.project.services;

import java.util.List;

import org.pis.project.entities.TeamMemberEntity;
import org.pis.project.repositories.TeamMemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class TeamMemberService {
    @Autowired
    private TeamMemberRepository teamMemberRepository;

    public List<TeamMemberEntity> TeamMembers() {
        return teamMemberRepository.findAll();
    }

    public TeamMemberEntity TeamMemberById(Integer id) {
        return teamMemberRepository.findById(id).orElse(null);
    }

    public TeamMemberEntity TeamMember(TeamMemberEntity TeamMember) {
        return teamMemberRepository.save(TeamMember);
    }

    public void TeamMember(Integer id) {
        teamMemberRepository.deleteById(id);
    }
}
