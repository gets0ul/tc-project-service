/* eslint-disable no-unused-expressions */
import _ from 'lodash';
import chai from 'chai';
import sinon from 'sinon';
import request from 'supertest';

import models from '../../models';
import util from '../../util';
import server from '../../app';
import testUtil from '../../tests/util';
import busApi from '../../services/busApi';
import {
  USER_ROLE,
  PROJECT_MEMBER_ROLE,
  INVITE_STATUS,
  BUS_API_EVENT,
} from '../../constants';

const should = chai.should();

describe('Project Member Invite create', () => {
  let project1;
  let project2;
  beforeEach((done) => {
    testUtil.clearDb()
      .then(() => {
        models.Project.create({
          type: 'generic',
          directProjectId: 1,
          billingAccountId: 1,
          name: 'test1',
          description: 'test project1',
          status: 'draft',
          details: {},
          createdBy: 1,
          updatedBy: 1,
          lastActivityAt: 1,
          lastActivityUserId: '1',
        }).then((p) => {
          project1 = p;
          // create members
          models.ProjectMember.create({
            userId: 40051332,
            projectId: project1.id,
            role: 'copilot',
            isPrimary: true,
            createdBy: 1,
            updatedBy: 1,
          });

          models.ProjectMember.create({
            userId: 40051334,
            projectId: project1.id,
            role: 'manager',
            isPrimary: true,
            createdBy: 1,
            updatedBy: 1,
          });

          models.ProjectMember.create({
            userId: 40158431,
            projectId: project1.id,
            role: 'customer',
            isPrimary: true,
            createdBy: 1,
            updatedBy: 1,
          });
        }).then(() =>
          models.Project.create({
            type: 'generic',
            billingAccountId: 1,
            name: 'test2',
            description: 'test project2',
            status: 'reviewed',
            details: {},
            createdBy: 1,
            updatedBy: 1,
            lastActivityAt: 1,
            lastActivityUserId: '1',
          }).then((p2) => {
            project2 = p2;
            models.ProjectMember.create({
              userId: 40051332,
              projectId: project2.id,
              role: 'copilot',
              isPrimary: true,
              createdBy: 1,
              updatedBy: 1,
            }).then(() => {
              const promises = [
                models.ProjectMemberInvite.create({
                  projectId: project1.id,
                  userId: 40051335,
                  email: null,
                  role: PROJECT_MEMBER_ROLE.MANAGER,
                  status: INVITE_STATUS.PENDING,
                  createdBy: 1,
                  updatedBy: 1,
                  createdAt: '2016-06-30 00:33:07+00',
                  updatedAt: '2016-06-30 00:33:07+00',
                }),
                models.ProjectMemberInvite.create({
                  projectId: project1.id,
                  email: 'duplicate_lowercase@test.com',
                  role: PROJECT_MEMBER_ROLE.MANAGER,
                  status: INVITE_STATUS.PENDING,
                  createdBy: 1,
                  updatedBy: 1,
                  createdAt: '2016-06-30 00:33:07+00',
                  updatedAt: '2016-06-30 00:33:07+00',
                }),
                models.ProjectMemberInvite.create({
                  projectId: project1.id,
                  email: 'DUPLICATE_UPPERCASE@test.com',
                  role: PROJECT_MEMBER_ROLE.MANAGER,
                  status: INVITE_STATUS.PENDING,
                  createdBy: 1,
                  updatedBy: 1,
                  createdAt: '2016-06-30 00:33:07+00',
                  updatedAt: '2016-06-30 00:33:07+00',
                }),
                models.ProjectMemberInvite.create({
                  projectId: project1.id,
                  email: 'with.dot@gmail.com',
                  role: PROJECT_MEMBER_ROLE.MANAGER,
                  status: INVITE_STATUS.PENDING,
                  createdBy: 1,
                  updatedBy: 1,
                  createdAt: '2016-06-30 00:33:07+00',
                  updatedAt: '2016-06-30 00:33:07+00',
                }),
                models.ProjectMemberInvite.create({
                  projectId: project1.id,
                  email: 'withoutdot@gmail.com',
                  role: PROJECT_MEMBER_ROLE.MANAGER,
                  status: INVITE_STATUS.PENDING,
                  createdBy: 1,
                  updatedBy: 1,
                  createdAt: '2016-06-30 00:33:07+00',
                  updatedAt: '2016-06-30 00:33:07+00',
                }),
              ];
              Promise.all(promises).then(() => {
                done();
              });
            });
          }));
      });
  });

  after((done) => {
    testUtil.clearDb(done);
  });

  describe('POST /projects/{id}/members/invite', () => {
    let sandbox;
    beforeEach(() => {
      sandbox = sinon.sandbox.create();
      // restoring the stubs in beforeEach instead of afterEach because these methods are already stubbed
      server.services.pubsub.init.restore();
      server.services.pubsub.publish.restore();
      sinon.stub(server.services.pubsub, 'init', () => {});
      sinon.stub(server.services.pubsub, 'publish', () => {});
      // by default mock lookupMultipleUserEmails return nothing so all the cases are not broken
      sandbox.stub(util, 'getUserRoles', () => Promise.resolve([]));
      sandbox.stub(util, 'lookupMultipleUserEmails', () => Promise.resolve([]));
      sandbox.stub(util, 'getMemberDetailsByUserIds', () => Promise.resolve([{
        userId: 40051333,
        firstName: 'Admin',
        lastName: 'User',
      }]));
    });
    afterEach(() => {
      sandbox.restore();
    });

    it('should return 201 if userIds and emails are presented the same time',
      (done) => {
        request(server)
          .post(`/v4/projects/${project2.id}/members/invite`)
          .set({
            Authorization: `Bearer ${testUtil.jwts.admin}`,
          })
          .send({
            param: {
              userIds: [40051331],
              emails: ['romit.choudhary@rivigo.com'],
              role: 'customer',
            },
          })
          .expect('Content-Type', /json/)
          .expect(201)
          .end((err, res) => {
            if (err) {
              done(err);
            } else {
              res.body.result.status.should.equal(201);
              done();
            }
          });
      });

    it('should return 400 if neither userIds or email is presented',
      (done) => {
        request(server)
          .post(`/v4/projects/${project1.id}/members/invite`)
          .set({
            Authorization: `Bearer ${testUtil.jwts.admin}`,
          })
          .send({
            param: {
              role: 'customer',
            },
          })
          .expect('Content-Type', /json/)
          .expect(400)
          .end((err, res) => {
            if (err) {
              done(err);
            } else {
              res.body.result.status.should.equal(400);
              done();
            }
          });
      });

    it('should return 403 if try to create copilot without MANAGER_ROLES', (done) => {
      const mockHttpClient = _.merge(testUtil.mockHttpClient, {
        get: () => Promise.resolve({
          status: 200,
          data: {
            id: 'requesterId',
            version: 'v3',
            result: {
              success: true,
              status: 200,
              content: [{
                roleName: USER_ROLE.COPILOT,
              }],
            },
          },
        }),
      });
      sandbox.stub(util, 'getHttpClient', () => mockHttpClient);
      request(server)
        .post(`/v4/projects/${project2.id}/members/invite`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .send({
          param: {
            userIds: [40152855],
            role: 'copilot',
          },
        })
        .expect('Content-Type', /json/)
        .expect(403)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            const resJson = res.body.result.content;
            res.body.result.status.should.equal(403);
            const errorMessage = _.get(resJson, 'message', '');
            sinon.assert.match(errorMessage, /.*You are not allowed to invite user as/);
            done();
          }
        });
    });

    it('should return 403 if try to create copilot with MEMBER', (done) => {
      const mockHttpClient = _.merge(testUtil.mockHttpClient, {
        get: () => Promise.resolve({
          status: 200,
          data: {
            id: 'requesterId',
            version: 'v3',
            result: {
              success: true,
              status: 200,
              content: [{
                roleName: USER_ROLE.CUSTOMER,
              }],
            },
          },
        }),
      });
      sandbox.stub(util, 'getHttpClient', () => mockHttpClient);
      request(server)
        .post(`/v4/projects/${project2.id}/members/invite`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .send({
          param: {
            userIds: [40152855],
            role: 'copilot',
          },
        })
        .expect('Content-Type', /json/)
        .expect(403)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            const resJson = res.body.result.content;
            res.body.result.status.should.equal(403);
            const errorMessage = _.get(resJson, 'message', '');
            sinon.assert.match(errorMessage, /.*You are not allowed to invite user as/);
            done();
          }
        });
    });

    it('should return 201 and add new email invite as customer', (done) => {
      const mockHttpClient = _.merge(testUtil.mockHttpClient, {
        get: () => Promise.resolve({
          status: 200,
          data: {
            id: 'requesterId',
            version: 'v3',
            result: {
              success: true,
              status: 200,
              content: {
                success: [{
                  roleName: USER_ROLE.COPILOT,
                }],
              },
            },
          },
        }),
      });
      sandbox.stub(util, 'getHttpClient', () => mockHttpClient);
      request(server)
        .post(`/v4/projects/${project2.id}/members/invite`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .send({
          param: {
            emails: ['hello@world.com'],
            role: 'customer',
          },
        })
        .expect('Content-Type', /json/)
        .expect(201)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            const resJson = res.body.result.content.success[0];
            should.exist(resJson);
            resJson.role.should.equal('customer');
            resJson.projectId.should.equal(project2.id);
            resJson.email.should.equal('he**o@wo**d.com'); // email is masked
            server.services.pubsub.publish.calledWith('project.member.invite.created').should.be.true;
            done();
          }
        });
    });

    it('should return 201 and add new userId invite as customer for existent user when invite by email', (done) => {
      const mockHttpClient = _.merge(testUtil.mockHttpClient, {
        get: () => Promise.resolve({
          status: 200,
          data: {
            id: 'requesterId',
            version: 'v3',
            result: {
              success: true,
              status: 200,
              content: {
                success: [{
                  roleName: USER_ROLE.COPILOT,
                }],
              },
            },
          },
        }),
      });
      sandbox.stub(util, 'getHttpClient', () => mockHttpClient);
      util.lookupMultipleUserEmails.restore();
      sandbox.stub(util, 'lookupMultipleUserEmails', () => Promise.resolve([{
        id: '12345',
        email: 'hello@world.com',
      }]));
      request(server)
        .post(`/v4/projects/${project2.id}/members/invite`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .send({
          param: {
            emails: ['hello@world.com'],
            role: 'customer',
          },
        })
        .expect('Content-Type', /json/)
        .expect(201)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            const resJson = res.body.result.content.success[0];
            should.exist(resJson);
            resJson.role.should.equal('customer');
            resJson.projectId.should.equal(project2.id);
            resJson.userId.should.equal(12345);
            resJson.email.should.equal('he**o@wo**d.com'); // email is masked
            server.services.pubsub.publish.calledWith('project.member.invite.created').should.be.true;
            done();
          }
        });
    });

    it('should return 201 and add new user invite as customer', (done) => {
      const mockHttpClient = _.merge(testUtil.mockHttpClient, {
        get: () => Promise.resolve({
          status: 200,
          data: {
            id: 'requesterId',
            version: 'v3',
            result: {
              success: true,
              status: 200,
              content: {
                success: [{
                  roleName: USER_ROLE.COPILOT,
                }],
              },
            },
          },
        }),
      });
      sandbox.stub(util, 'getHttpClient', () => mockHttpClient);
      request(server)
        .post(`/v4/projects/${project2.id}/members/invite`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .send({
          param: {
            userIds: [40152855],
            role: 'customer',
          },
        })
        .expect('Content-Type', /json/)
        .expect(201)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            const resJson = res.body.result.content.success[0];
            should.exist(resJson);
            resJson.role.should.equal('customer');
            resJson.projectId.should.equal(project2.id);
            resJson.userId.should.equal(40152855);
            server.services.pubsub.publish.calledWith('project.member.invite.created').should.be.true;
            done();
          }
        });
    });

    it('should return 403 and failed list when trying add already team member by userId', (done) => {
      const mockHttpClient = _.merge(testUtil.mockHttpClient, {
        get: () => Promise.resolve({
          status: 200,
          data: {
            id: 'requesterId',
            version: 'v3',
            result: {
              success: true,
              status: 200,
              content: {
                success: [{
                  roleName: USER_ROLE.COPILOT,
                }],
              },
            },
          },
        }),
      });
      sandbox.stub(util, 'getHttpClient', () => mockHttpClient);
      request(server)
        .post(`/v4/projects/${project1.id}/members/invite`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .send({
          param: {
            userIds: [40158431],
            role: 'customer',
          },
        })
        .expect('Content-Type', /json/)
        .expect(403)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            const resJson = res.body.result.content.failed;
            should.exist(resJson);
            resJson[0].userId.should.equal(40158431);
            resJson[0].message.should.equal('User with such handle is already a member of the team.');
            resJson.length.should.equal(1);
            server.services.pubsub.publish.neverCalledWith('project.member.invite.created').should.be.true;
            done();
          }
        });
    });

    it('should return 403 and failed list when trying add already team member by email', (done) => {
      const mockHttpClient = _.merge(testUtil.mockHttpClient, {
        get: () => Promise.resolve({
          status: 200,
          data: {
            id: 'requesterId',
            version: 'v3',
            result: {
              success: true,
              status: 200,
              content: {
                success: [{
                  roleName: USER_ROLE.COPILOT,
                }],
              },
            },
          },
        }),
      });
      sandbox.stub(util, 'getHttpClient', () => mockHttpClient);
      util.lookupMultipleUserEmails.restore();
      sandbox.stub(util, 'lookupMultipleUserEmails', () => Promise.resolve([{
        id: '40158431',
        email: 'romit.choudhary@rivigo.com',
      }]));
      request(server)
        .post(`/v4/projects/${project1.id}/members/invite`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .send({
          param: {
            emails: ['romit.choudhary@rivigo.com'],
            role: 'customer',
          },
        })
        .expect('Content-Type', /json/)
        .expect(403)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            const resJson = res.body.result.content.failed;
            should.exist(resJson);
            resJson[0].email.should.equal('romit.choudhary@rivigo.com');
            resJson[0].message.should.equal('User with such email is already a member of the team.');
            resJson.length.should.equal(1);
            server.services.pubsub.publish.neverCalledWith('project.member.invite.created').should.be.true;
            done();
          }
        });
    });

    it('should return 403 and failed list when trying add already invited member by userId', (done) => {
      const mockHttpClient = _.merge(testUtil.mockHttpClient, {
        get: () => Promise.resolve({
          status: 200,
          data: {
            id: 'requesterId',
            version: 'v3',
            result: {
              success: true,
              status: 200,
              content: {
                success: [{
                  roleName: USER_ROLE.COPILOT,
                }],
              },
            },
          },
        }),
      });
      sandbox.stub(util, 'getHttpClient', () => mockHttpClient);
      request(server)
        .post(`/v4/projects/${project1.id}/members/invite`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .send({
          param: {
            userIds: [40051335],
            role: 'customer',
          },
        })
        .expect('Content-Type', /json/)
        .expect(403)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            const resJson = res.body.result.content.failed;
            should.exist(resJson);
            resJson.length.should.equal(1);
            resJson[0].userId.should.equal(40051335);
            resJson[0].message.should.equal('User with such handle is already invited to this project.');
            server.services.pubsub.publish.neverCalledWith('project.member.invite.created').should.be.true;
            done();
          }
        });
    });

    it('should return 403 if try to create manager without MANAGER_ROLES', (done) => {
      const mockHttpClient = _.merge(testUtil.mockHttpClient, {
        get: () => Promise.resolve({
          status: 200,
          data: {
            id: 'requesterId',
            version: 'v3',
            result: {
              success: true,
              status: 200,
              content: [{
                roleName: USER_ROLE.COPILOT,
              }],
            },
          },
        }),
        post: () => Promise.resolve({
          status: 200,
          data: {
            id: 'requesterId',
            version: 'v3',
            result: {
              success: true,
              status: 200,
              content: {},
            },
          },
        }),
      });
      sandbox.stub(util, 'getHttpClient', () => mockHttpClient);
      request(server)
        .post(`/v4/projects/${project1.id}/members/invite`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .send({
          param: {
            userIds: [40152855],
            role: 'manager',
          },
        })
        .expect('Content-Type', /json/)
        .expect(403)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            const resJson = res.body.result.content;
            should.exist(resJson);
            res.body.result.status.should.equal(403);
            const errorMessage = _.get(resJson, 'message', '');
            sinon.assert.match(errorMessage, /.*not allowed to invite user as/);
            done();
          }
        });
    });

    it('should return 201 if try to create manager with MANAGER_ROLES', (done) => {
      util.getUserRoles.restore();
      sandbox.stub(util, 'getUserRoles', () => Promise.resolve([USER_ROLE.MANAGER]));
      request(server)
        .post(`/v4/projects/${project1.id}/members/invite`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.manager}`,
        })
        .send({
          param: {
            userIds: [40152855],
            role: 'manager',
          },
        })
        .expect('Content-Type', /json/)
        .expect(201)
        .end((err, res) => {
          const resJson = res.body.result.content.success[0];
          should.exist(resJson);
          resJson.role.should.equal('manager');
          resJson.projectId.should.equal(project1.id);
          resJson.userId.should.equal(40152855);
          server.services.pubsub.publish.calledWith('project.member.invite.created').should.be.true;
          done();
        });
    });

    it('should return 201 if try to create account_manager with MANAGER_ROLES', (done) => {
      util.getUserRoles.restore();
      sandbox.stub(util, 'getUserRoles', () => Promise.resolve([USER_ROLE.MANAGER]));
      request(server)
        .post(`/v4/projects/${project1.id}/members/invite`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.manager}`,
        })
        .send({
          param: {
            userIds: [40152855],
            role: 'account_manager',
          },
        })
        .expect('Content-Type', /json/)
        .expect(201)
        .end((err, res) => {
          const resJson = res.body.result.content.success[0];
          should.exist(resJson);
          resJson.role.should.equal('account_manager');
          resJson.projectId.should.equal(project1.id);
          resJson.userId.should.equal(40152855);
          server.services.pubsub.publish.calledWith('project.member.invite.created').should.be.true;
          done();
        });
    });

    it('should return 403 if try to create account_manager with CUSTOMER_ROLE', (done) => {
      util.getUserRoles.restore();
      sandbox.stub(util, 'getUserRoles', () => Promise.resolve(['Topcoder User']));
      request(server)
        .post(`/v4/projects/${project1.id}/members/invite`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.manager}`,
        })
        .send({
          param: {
            userIds: [40152855],
            role: 'account_manager',
          },
        })
        .expect('Content-Type', /json/)
        .expect(403)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            const resJson = res.body.result.content.failed[0];
            should.exist(resJson);
            res.body.result.status.should.equal(403);
            const errorMessage = _.get(resJson, 'message', '');
            sinon.assert.match(errorMessage, /.*cannot be added with a Manager role to the project/);
            done();
          }
        });
    });

    it('should return 201 if try to create customer with COPILOT', (done) => {
      const mockHttpClient = _.merge(testUtil.mockHttpClient, {
        get: () => Promise.resolve({
          status: 200,
          data: {
            id: 'requesterId',
            version: 'v3',
            result: {
              success: true,
              status: 200,
              content: {
                success: [{
                  roleName: USER_ROLE.COPILOT,
                }],
              },
            },
          },
        }),
      });
      sandbox.stub(util, 'getHttpClient', () => mockHttpClient);
      request(server)
        .post(`/v4/projects/${project1.id}/members/invite`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.manager}`,
        })
        .send({
          param: {
            userIds: [40051331],
            role: 'copilot',
          },
        })
        .expect('Content-Type', /json/)
        .expect(201)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            const resJson = res.body.result.content.success[0];
            should.exist(resJson);
            resJson.role.should.equal('copilot');
            resJson.projectId.should.equal(project1.id);
            resJson.userId.should.equal(40051331);
            server.services.pubsub.publish.calledWith('project.member.invite.created').should.be.true;
            done();
          }
        });
    });

    it('should return 403 and failed list when trying add already invited member by lowercase email', (done) => {
      request(server)
        .post(`/v4/projects/${project1.id}/members/invite`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .send({
          param: {
            emails: ['DUPLICATE_LOWERCASE@test.com'],
            role: 'customer',
          },
        })
        .expect('Content-Type', /json/)
        .expect(403)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            const resJson = res.body.result.content.failed;
            should.exist(resJson);
            resJson[0].email.should.equal('duplicate_lowercase@test.com');
            resJson[0].message.should.equal('User with such email is already invited to this project.');
            resJson.length.should.equal(1);
            done();
          }
        });
    });

    it('should return 403 and failed list when trying add already invited member by uppercase email', (done) => {
      request(server)
        .post(`/v4/projects/${project1.id}/members/invite`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .send({
          param: {
            emails: ['duplicate_uppercase@test.com'],
            role: 'customer',
          },
        })
        .expect('Content-Type', /json/)
        .expect(403)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            const resJson = res.body.result.content.failed;
            should.exist(resJson);
            resJson[0].email.should.equal('DUPLICATE_UPPERCASE@test.com'); // email is masked
            resJson[0].message.should.equal('User with such email is already invited to this project.');
            resJson.length.should.equal(1);
            done();
          }
        });
    });

    xit('should return 403 and failed list when trying add already invited member by gmail email with dot',
      (done) => {
        request(server)
          .post(`/v4/projects/${project1.id}/members/invite`)
          .set({
            Authorization: `Bearer ${testUtil.jwts.copilot}`,
          })
          .send({
            param: {
              emails: ['WITHdot@gmail.com'],
              role: 'customer',
            },
          })
          .expect('Content-Type', /json/)
          .expect(403)
          .end((err, res) => {
            if (err) {
              done(err);
            } else {
              const resJson = res.body.result.content.failed;
              should.exist(resJson);
              resJson[0].email.should.equal('WITHdot@gmail.com');
              resJson.length.should.equal(1);
              done();
            }
          });
      });

    xit('should return 403 and failed list when trying add already invited member by gmail email without dot',
      (done) => {
        request(server)
          .post(`/v4/projects/${project1.id}/members/invite`)
          .set({
            Authorization: `Bearer ${testUtil.jwts.copilot}`,
          })
          .send({
            param: {
              emails: ['WITHOUT.dot@gmail.com'],
              role: 'customer',
            },
          })
          .expect('Content-Type', /json/)
          .expect(403)
          .end((err, res) => {
            if (err) {
              done(err);
            } else {
              const resJson = res.body.result.content.failed;
              should.exist(resJson);
              resJson.length.should.equal(1);
              resJson[0].email.should.equal('WITHOUT.dot@gmail.com');
              done();
            }
          });
      });

    describe('Bus api', () => {
      let createEventSpy;

      before((done) => {
        // Wait for 500ms in order to wait for createEvent calls from previous tests to complete
        testUtil.wait(done);
      });

      beforeEach(() => {
        createEventSpy = sandbox.spy(busApi, 'createEvent');
      });

      it('sends single BUS_API_EVENT.PROJECT_MEMBER_INVITE_CREATED message when userId invite added', (done) => {
        const mockHttpClient = _.merge(testUtil.mockHttpClient, {
          get: () => Promise.resolve({
            status: 200,
            data: {
              id: 'requesterId',
              version: 'v3',
              result: {
                success: true,
                status: 200,
                content: [{
                  roleName: USER_ROLE.MANAGER,
                }],
              },
            },
          }),
        });
        sandbox.stub(util, 'getHttpClient', () => mockHttpClient);
        request(server)
          .post(`/v4/projects/${project1.id}/members/invite`)
          .set({
            Authorization: `Bearer ${testUtil.jwts.manager}`,
          })
          .send({
            param: {
              userIds: [3],
              role: PROJECT_MEMBER_ROLE.CUSTOMER,
            },
          })
          .expect(201)
          .end((err) => {
            if (err) {
              done(err);
            } else {
              testUtil.wait(() => {
                createEventSpy.calledOnce.should.be.true;
                createEventSpy.calledWith(BUS_API_EVENT.PROJECT_MEMBER_INVITE_CREATED, sinon.match({
                  projectId: project1.id,
                  userId: 3,
                  email: null,
                  isSSO: false,
                })).should.be.true;
                done();
              });
            }
          });
      });

      it('sends single BUS_API_EVENT.PROJECT_MEMBER_INVITE_CREATED message when email invite added', (done) => {
        const mockHttpClient = _.merge(testUtil.mockHttpClient, {
          get: () => Promise.resolve({
            status: 200,
            data: {
              id: 'requesterId',
              version: 'v3',
              result: {
                success: true,
                status: 200,
                content: [{
                  roleName: USER_ROLE.MANAGER,
                }],
              },
            },
          }),
        });
        sandbox.stub(util, 'getHttpClient', () => mockHttpClient);
        request(server)
          .post(`/v4/projects/${project1.id}/members/invite`)
          .set({
            Authorization: `Bearer ${testUtil.jwts.manager}`,
          })
          .send({
            param: {
              emails: ['hello@world.com'],
              role: PROJECT_MEMBER_ROLE.CUSTOMER,
            },
          })
          .expect(201)
          .end((err) => {
            if (err) {
              done(err);
            } else {
              testUtil.wait(() => {
                createEventSpy.calledTwice.should.be.true;
                createEventSpy.calledWith(BUS_API_EVENT.PROJECT_MEMBER_INVITE_CREATED, sinon.match({
                  projectId: project1.id,
                  userId: null,
                  email: 'hello@world.com',
                  isSSO: false,
                })).should.be.true;
                done();
              });
            }
          });
      });
    });
  });
});
