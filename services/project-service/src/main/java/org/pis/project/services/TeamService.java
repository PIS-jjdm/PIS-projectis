package org.pis.project.services;

import java.util.List;
import java.util.UUID;

import org.pis.project.entities.TeamEntity;
import org.pis.project.repositories.TeamRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class TeamService {
  public List<TeamEntity> listTeams(UUID projectId) {
    return teamRepository.findByProjectId(projectId);
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
