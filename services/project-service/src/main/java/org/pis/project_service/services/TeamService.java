package org.pis.project_service.services;

import java.util.List;

import org.pis.project_service.models.entities.Team;
import org.pis.project_service.repositories.TeamRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class TeamService {
    @Autowired
    private TeamRepository teamRepository;

    public List<Team> Teams() {
        return teamRepository.findAll();
    }

    public Team TeamById(Integer id) {
        return teamRepository.findById(id).orElse(null);
    }

    public Team Team(Team Team) {
        return teamRepository.save(Team);
    }

    public void Team(Integer id) {
        teamRepository.deleteById(id);
    }
}
