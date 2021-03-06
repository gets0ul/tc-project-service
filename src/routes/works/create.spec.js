/* eslint-disable no-unused-expressions */
/**
 * Tests for create.js
 */

import _ from 'lodash';
import chai from 'chai';
import sinon from 'sinon';
import request from 'supertest';
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

const should = chai.should();

const validatePhase = (resJson, expectedPhase) => {
  should.exist(resJson);
  resJson.name.should.be.eql(expectedPhase.name);
  resJson.description.should.be.eql(expectedPhase.description);
  resJson.requirements.should.be.eql(expectedPhase.requirements);
  resJson.status.should.be.eql(expectedPhase.status);
  resJson.budget.should.be.eql(expectedPhase.budget);
  resJson.progress.should.be.eql(expectedPhase.progress);
  resJson.details.should.be.eql(expectedPhase.details);
};

describe('CREATE work', () => {
  let projectId;
  let projectName;
  let workStreamId;

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
            policy: 'work.create',
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

  after(testUtil.clearDb);

  describe('PATCH /projects/{projectId}/workstreams/{workStreamId}/works', () => {
    const body = {
      param: {
        name: 'test project phase',
        description: 'test project phase description',
        requirements: 'test project phase requirements',
        status: 'active',
        startDate: '2018-05-15T00:00:00Z',
        endDate: '2018-05-15T12:00:00Z',
        budget: 20.0,
        progress: 1.23456,
        spentBudget: 10.0,
        duration: 10,
        details: {
          message: 'This can be any json',
        },
      },
    };

    it('should return 403 if user is not authenticated', (done) => {
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works`)
        .send(body)
        .expect(403, done);
    });

    it('should return 403 for copilot', (done) => {
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works`)
        .send(body)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .expect(403, done);
    });

    it('should return 404 for non-existed work stream', (done) => {
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/1234/works`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.manager}`,
        })
        .send(body)
        .expect(404, done);
    });

    it('should return 404 for deleted work stream', (done) => {
      models.WorkStream.destroy({ where: { id: workStreamId } })
        .then(() => {
          request(server)
            .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works`)
            .set({
              Authorization: `Bearer ${testUtil.jwts.manager}`,
            })
            .send(body)
            .expect(404, done);
        });
    });

    it('should return 422 when name not provided', (done) => {
      const reqBody = _.cloneDeep(body);
      delete reqBody.param.name;
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .send(reqBody)
        .expect('Content-Type', /json/)
        .expect(422, done);
    });

    it('should return 422 when status not provided', (done) => {
      const reqBody = _.cloneDeep(body);
      delete reqBody.param.status;
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .send(reqBody)
        .expect('Content-Type', /json/)
        .expect(422, done);
    });

    it('should return 422 when startDate > endDate', (done) => {
      const reqBody = _.cloneDeep(body);
      reqBody.param.startDate = '2018-05-16T12:00:00';
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.manager}`,
        })
        .send(reqBody)
        .expect('Content-Type', /json/)
        .expect(422, done);
    });

    it('should return 422 when budget is negative', (done) => {
      const reqBody = _.cloneDeep(body);
      reqBody.param.budget = -20;
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .send(reqBody)
        .expect('Content-Type', /json/)
        .expect(422, done);
    });

    it('should return 422 when progress is negative', (done) => {
      const reqBody = _.cloneDeep(body);
      reqBody.param.progress = -20;
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .send(reqBody)
        .expect('Content-Type', /json/)
        .expect(422, done);
    });

    it('should return 201 for member', (done) => {
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.member}`,
        })
        .send(body)
        .expect(201, done);
    });

    it('should return 200 for connect admin', (done) => {
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.connectAdmin}`,
        })
        .send(body)
        .expect(200)
        .end((err, res) => {
          const resJson = res.body.result.content;
          validatePhase(resJson, body.param);
          done();
        });
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

      it('should send message BUS_API_EVENT.PROJECT_PLAN_UPDATED when work added', (done) => {
        request(server)
        .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.member}`,
        })
        .send(body)
        .expect('Content-Type', /json/)
        .expect(201)
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
                userId: 40051331,
                initiatorUserId: 40051331,
              })).should.be.true;
              done();
            });
          }
        });
      });
    });

    describe('RabbitMQ Message topic', () => {
      let createMessageSpy;
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
            doc: project,
          },
        });

        testUtil.wait(() => {
          publishSpy = sandbox.spy(server.services.pubsub, 'publish');
          createMessageSpy = sandbox.spy(messageService, 'createTopic');
          done();
        });
      });

      afterEach(() => {
        sandbox.restore();
      });

      after(() => {
        mockRabbitMQ(server);
      });

      it('should send message topic when work added', (done) => {
        const mockHttpClient = _.merge(testUtil.mockHttpClient, {
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
        sandbox.stub(messageService, 'getClient', () => mockHttpClient);
        request(server)
            .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works`)
            .set({
              Authorization: `Bearer ${testUtil.jwts.connectAdmin}`,
            })
            .send(body)
            .expect(201)
            .end((err) => {
              if (err) {
                done(err);
              } else {
                testUtil.wait(() => {
                  publishSpy.calledOnce.should.be.true;
                  publishSpy.calledWith('project.phase.added').should.be.true;
                  createMessageSpy.calledTwice.should.be.true;
                  done();
                });
              }
            });
      });
    });
  });
});
