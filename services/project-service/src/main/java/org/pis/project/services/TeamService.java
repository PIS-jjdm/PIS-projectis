package org.pis.project.services;

import java.util.List;

import org.pis.project.entities.TeamEntity;
import org.pis.project.repositories.TeamRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class TeamService {
    @Autowired
    private TeamRepository teamRepository;

    public List<TeamEntity> Teams() {
        return teamRepository.findAll();
    }

    public TeamEntity TeamById(Integer id) {
        return teamRepository.findById(id).orElse(null);
    }

    public TeamEntity Team(TeamEntity Team) {
        return teamRepository.save(Team);
    }

    public void Team(Integer id) {
        teamRepository.deleteById(id);
    }
}
