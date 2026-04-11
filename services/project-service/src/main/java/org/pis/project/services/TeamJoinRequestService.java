package org.pis.project.services;

import java.util.List;

import org.pis.project.entities.TeamJoinRequestEntity;
import org.pis.project.repositories.TeamJoinRequestRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class TeamJoinRequestService {
    @Autowired
    private TeamJoinRequestRepository teamJoinRequestRepository;

    public List<TeamJoinRequestEntity> TeamJoinRequests() {
        return teamJoinRequestRepository.findAll();
    }

    public TeamJoinRequestEntity TeamJoinRequestById(Integer id) {
        return teamJoinRequestRepository.findById(id).orElse(null);
    }

    public TeamJoinRequestEntity TeamJoinRequest(TeamJoinRequestEntity TeamJoinRequest) {
        return teamJoinRequestRepository.save(TeamJoinRequest);
    }

    public void TeamJoinRequest(Integer id) {
        teamJoinRequestRepository.deleteById(id);
    }
}
