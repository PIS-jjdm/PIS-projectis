package org.pis.project_service.services;

import java.util.List;

import org.pis.project_service.models.entities.TeamJoinRequest;
import org.pis.project_service.repositories.TeamJoinRequestRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class TeamJoinRequestService {
    @Autowired
    private TeamJoinRequestRepository teamJoinRequestRepository;

    public List<TeamJoinRequest> TeamJoinRequests() {
        return teamJoinRequestRepository.findAll();
    }

    public TeamJoinRequest TeamJoinRequestById(Integer id) {
        return teamJoinRequestRepository.findById(id).orElse(null);
    }

    public TeamJoinRequest TeamJoinRequest(TeamJoinRequest TeamJoinRequest) {
        return teamJoinRequestRepository.save(TeamJoinRequest);
    }

    public void TeamJoinRequest(Integer id) {
        teamJoinRequestRepository.deleteById(id);
    }
}
