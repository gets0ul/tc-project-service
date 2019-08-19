/* eslint-disable no-unused-expressions */
/**
 * Tests for delete.js
 */
import _ from 'lodash';
import request from 'supertest';
import chai from 'chai';
import sinon from 'sinon';
import config from 'config';
import models from '../../models';
import server from '../../app';
import testUtil from '../../tests/util';
import busApi from '../../services/busApi';
import messageService from '../../services/messageService';
import RabbitMQService from '../../services/rabbitmq';
import mockRabbitMQ from '../../tests/mockRabbitMQ';
import { BUS_API_EVENT } from '../../constants';

const ES_PROJECT_INDEX = config.get('elasticsearchConfig.indexName');
const ES_PROJECT_TYPE = config.get('elasticsearchConfig.docType');

chai.should();

const expectAfterDelete = (workId, projectId, workStreamId, err, next) => {
  if (err) throw err;
  setTimeout(() =>
  models.ProjectPhase.findOne({
    where: {
      id: workId,
    },
    paranoid: false,
  })
    .then((res) => {
      if (!res) {
        throw new Error('Should found the entity');
      } else {
        chai.assert.isNotNull(res.deletedAt);
        chai.assert.isNotNull(res.deletedBy);

        request(server)
          .get(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
          .set({
            Authorization: `Bearer ${testUtil.jwts.admin}`,
          })
          .expect(404, next);
      }
    }), 500);
};

describe('DELETE work', () => {
  let projectId;
  let projectName;
  let workStreamId;
  let workId;

  const memberUser = {
    handle: testUtil.getDecodedToken(testUtil.jwts.member).handle,
    userId: testUtil.getDecodedToken(testUtil.jwts.member).userId,
    firstName: 'fname',
    lastName: 'lName',
    email: 'some@abc.com',
  };
  const copilotUser = {
    handle: testUtil.getDecodedToken(testUtil.jwts.copilot).handle,
    userId: testUtil.getDecodedToken(testUtil.jwts.copilot).userId,
    firstName: 'fname',
    lastName: 'lName',
    email: 'some@abc.com',
  };
  const project = {
    type: 'generic',
    billingAccountId: 1,
    name: 'test1',
    description: 'test project1',
    status: 'draft',
    details: {},
    createdBy: 1,
    updatedBy: 1,
    lastActivityAt: 1,
    lastActivityUserId: '1',
  };
  const topic = {
    id: 1,
    title: 'test project phase',
    posts:
    [{ id: 1,
      type: 'post',
      body: 'body',
    }],
  };
  beforeEach((done) => {
    testUtil.clearDb()
      .then(() => {
        models.ProjectTemplate.create({
          name: 'template 2',
          key: 'key 2',
          category: 'category 2',
          icon: 'http://example.com/icon1.ico',
          question: 'question 2',
          info: 'info 2',
          aliases: ['key-2', 'key_2'],
          scope: {},
          phases: {},
          createdBy: 1,
          updatedBy: 2,
        })
        .then((template) => {
          models.WorkManagementPermission.create({
            policy: 'work.delete',
            permission: {
              allowRule: {
                projectRoles: ['customer', 'copilot'],
                topcoderRoles: ['Connect Manager', 'Connect Admin', 'administrator'],
              },
              denyRule: { projectRoles: ['copilot'] },
            },
            projectTemplateId: template.id,
            details: {},
            createdBy: 1,
            updatedBy: 1,
            lastActivityAt: 1,
            lastActivityUserId: '1',
          })
          .then(() => {
            // Create projects
            models.Project.create(_.assign(project, { templateId: template.id }))
            .then((_project) => {
              projectId = _project.id;
              projectName = _project.name;
              models.WorkStream.create({
                name: 'Work Stream',
                type: 'generic',
                status: 'active',
                projectId,
                createdBy: 1,
                updatedBy: 1,
              }).then((entity) => {
                workStreamId = entity.id;
                models.ProjectPhase.create({
                  name: 'test project phase',
                  status: 'active',
                  startDate: '2018-05-15T00:00:00Z',
                  endDate: '2018-05-15T12:00:00Z',
                  budget: 20.0,
                  progress: 1.23456,
                  details: {
                    message: 'This can be any json',
                  },
                  createdBy: 1,
                  updatedBy: 1,
                  projectId,
                }).then((phase) => {
                  workId = phase.id;
                  models.PhaseWorkStream.create({
                    phaseId: workId,
                    workStreamId,
                  }).then(() => {
                    // create members
                    models.ProjectMember.bulkCreate([{
                      id: 1,
                      userId: copilotUser.userId,
                      projectId,
                      role: 'copilot',
                      isPrimary: false,
                      createdBy: 1,
                      updatedBy: 1,
                    }, {
                      id: 2,
                      userId: memberUser.userId,
                      projectId,
                      role: 'customer',
                      isPrimary: true,
                      createdBy: 1,
                      updatedBy: 1,
                    }]).then(() => done());
                  });
                });
              });
            });
          });
        });
      });
  });

  after(testUtil.clearDb);

  describe('DELETE /projects/{projectId}/workstreams/{workStreamId}/works/{workId}', () => {
    it('should return 403 if user is not authenticated', (done) => {
      request(server)
        .delete(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .expect(403, done);
    });

    it('should return 403 for copilot', (done) => {
      request(server)
        .delete(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .expect(403, done);
    });

    it('should return 404 when no work stream with specific workStreamId', (done) => {
      request(server)
        .delete(`/v4/projects/${projectId}/workstreams/999/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .expect('Content-Type', /json/)
        .expect(404, done);
    });

    it('should return 404 when no work with specific workId', (done) => {
      request(server)
        .delete(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/999`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .expect('Content-Type', /json/)
        .expect(404, done);
    });

    it('should return 404 for deleted type', (done) => {
      models.ProjectPhase.destroy({ where: { id: workId } })
        .then(() => {
          request(server)
            .delete(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
            .set({
              Authorization: `Bearer ${testUtil.jwts.admin}`,
            })
            .expect(404, done);
        });
    });

    it('should return 204 for member', (done) => {
      request(server)
        .delete(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.member}`,
        })
        .expect(204)
        .end(err => expectAfterDelete(workId, projectId, workStreamId, err, done));
    });

    it('should return 204, for admin, if type was successfully removed', (done) => {
      request(server)
        .delete(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .expect(204)
        .end(err => expectAfterDelete(workId, projectId, workStreamId, err, done));
    });

    it('should return 204, for connect admin, if type was successfully removed', (done) => {
      request(server)
        .delete(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.connectAdmin}`,
        })
        .expect(204)
        .end(err => expectAfterDelete(workId, projectId, workStreamId, err, done));
    });

    describe('Bus api', () => {
      let createEventSpy;
      const sandbox = sinon.sandbox.create();

      before((done) => {
        // Wait for 500ms in order to wait for createEvent calls from previous tests to complete
        testUtil.wait(done);
      });

      beforeEach(() => {
        createEventSpy = sandbox.spy(busApi, 'createEvent');
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('should send message BUS_API_EVENT.PROJECT_PLAN_UPDATED when work removed', (done) => {
        request(server)
        .delete(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.connectAdmin}`,
        })
        .expect(204)
        .end((err) => {
          if (err) {
            done(err);
          } else {
            testUtil.wait(() => {
              createEventSpy.calledOnce.should.be.true;
              createEventSpy.calledWith(BUS_API_EVENT.PROJECT_PLAN_UPDATED, sinon.match({
                projectId,
                projectName,
                projectUrl: `https://local.topcoder-dev.com/projects/${projectId}`,
                userId: 40051336,
                initiatorUserId: 40051336,
              })).should.be.true;
              done();
            });
          }
        });
      });
    });

    describe('RabbitMQ Message topic', () => {
      let deleteTopicSpy;
      let deletePostsSpy;
      let publishSpy;
      let sandbox;

      before(async (done) => {
        // Wait for 500ms in order to wait for createEvent calls from previous tests to complete
        testUtil.wait(done);
      });

      beforeEach(async (done) => {
        sandbox = sinon.sandbox.create();
        server.services.pubsub = new RabbitMQService(server.logger);

        // initialize RabbitMQ
        server.services.pubsub.init(
          config.get('rabbitmqURL'),
          config.get('pubsubExchangeName'),
          config.get('pubsubQueueName'),
        );

        // add project to ES index
        await server.services.es.index({
          index: ES_PROJECT_INDEX,
          type: ES_PROJECT_TYPE,
          id: projectId,
          body: {
            doc: _.assign(project, { phases: [_.assign({
              name: 'test project phase',
              status: 'active',
              startDate: '2018-05-15T00:00:00Z',
              endDate: '2018-05-15T12:00:00Z',
              budget: 20.0,
              progress: 1.23456,
              details: {
                message: 'This can be any json',
              },
              createdBy: 1,
              updatedBy: 1,
              projectId,
            }, { id: workId, projectId })] }),
          },
        });

        testUtil.wait(() => {
          publishSpy = sandbox.spy(server.services.pubsub, 'publish');
          deleteTopicSpy = sandbox.spy(messageService, 'deleteTopic');
          deletePostsSpy = sandbox.spy(messageService, 'deletePosts');
          sandbox.stub(messageService, 'getTopicByTag', () => Promise.resolve(topic));
          done();
        });
      });

      afterEach(() => {
        sandbox.restore();
      });

      after(() => {
        mockRabbitMQ(server);
      });

      it('should send message topic when work deleted', (done) => {
        const mockHttpClient = _.merge(testUtil.mockHttpClient, {
          delete: () => Promise.resolve(true),
        });
        sandbox.stub(messageService, 'getClient', () => mockHttpClient);
        request(server)
            .delete(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
            .set({
              Authorization: `Bearer ${testUtil.jwts.admin}`,
            })
            .expect(204)
            .end((err) => {
              if (err) {
                done(err);
              } else {
                testUtil.wait(() => {
                  publishSpy.calledOnce.should.be.true;
                  publishSpy.calledWith('project.phase.removed').should.be.true;
                  deleteTopicSpy.calledTwice.should.be.true;
                  deletePostsSpy.calledTwice.should.be.true;
                  done();
                });
              }
            });
      });
    });
  });
});
