

import _ from 'lodash';
import Joi from 'joi';
import validate from 'express-validation';
import { middleware as tcMiddleware } from 'tc-core-library-js';
import models from '../../models';
import util from '../../util';

/**
 * API to update invite member to project.
 *
 */
const schema = {
  query: {
    fields: Joi.string().optional(),
  },
};

const permissions = tcMiddleware.permissions;

module.exports = [
  validate(schema),
  permissions('projectMemberInvite.get'),
  (req, res, next) => {
    const projectId = _.parseInt(req.params.projectId);
    const inviteId = _.parseInt(req.params.inviteId);
    const currentUserId = req.authUser.userId;
    const email = req.authUser.email;
    const fields = req.query.fields ? req.query.fields.split(',') : null;

    const esSearchParam = {
      query: {
        nested: {
          path: 'invites',
          query:
          {
            filtered: {
              filter: {
                bool: {
                  must: [
                    { term: { 'invites.projectId': projectId } },
                    { term: { 'invites.id': inviteId } },
                  ],
                },
              },
            },
          },
          inner_hits: {},
        },
      },
    };

    if (req.context.inviteType === 'list') {
      // user can only his/her own invite with specific id
      esSearchParam.query.nested.query.filtered.filter.bool.must.push({
        bool: {
          should: [
            { term: { 'invites.email': email } },
            { term: { 'invites.userId': currentUserId } },
          ],
          minimum_number_should_match: 1,
        },
      });
    }
    util.fetchByIdFromES('invites', esSearchParam).then((data) => {
      if (data.length === 0) {
        req.log.debug('No project member invite found in ES');
        let getInvitePromise;
        if (req.context.inviteType === 'all') {
          getInvitePromise = models.ProjectMemberInvite.getPendingInviteByIdForUser(projectId, inviteId);
        } else {
          getInvitePromise = models.ProjectMemberInvite.getPendingInviteByIdForUser(
            projectId, inviteId, email, currentUserId);
        }
        return getInvitePromise.then((invite) => {
          if (!invite) {
            // check there is an existing invite for the user with status PENDING
            // handle 404
            let errMsg;
            if (req.context.inviteType === 'all') {
              errMsg = `invite not found for project id ${projectId}, inviteId ${inviteId}`;
            } else {
              errMsg = `invite not found for project id ${projectId}, inviteId ${inviteId}, ` +
                `userId ${currentUserId} and email ${email}`;
            }
            const err = new Error(errMsg);
            err.status = 404;
            throw err;
          }
          return invite;
        });
      }
      req.log.debug('project member found in ES');
      return data[0].inner_hits.invites.hits.hits[0]._source; // eslint-disable-line no-underscore-dangle
    }).then(invite => (
      util.getObjectsWithMemberDetails([invite], fields, req)
        .then(([inviteWithDetails]) => inviteWithDetails)
        .catch((err) => {
          req.log.error('Cannot get user details for invite.');
          req.log.debug('Error during getting user details for invite.', err);
        })
    ))
    .then(invite => res.json(util.maskInviteEmails('$[*].email', invite, req)))
    .catch(next);
  },
];
