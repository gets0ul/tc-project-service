/**
 * Tests for create.js
 */
import _ from 'lodash';
import chai from 'chai';
import request from 'supertest';
import server from '../../app';
import models from '../../models';
import testUtil from '../../tests/util';

const should = chai.should();

const body = {
  name: 'test phase product',
  type: 'product1',
  estimatedPrice: 20.0,
  actualPrice: 1.23456,
  details: {
    message: 'This can be any json',
  },
};

describe('CREATE Work Item', () => {
  let projectId;
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
            policy: 'workItem.create',
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
            models.Project.create({
              type: 'generic',
              billingAccountId: 1,
              name: 'test1',
              description: 'test project1',
              status: 'draft',
              templateId: template.id,
              details: {},
              createdBy: 1,
              updatedBy: 1,
              lastActivityAt: 1,
              lastActivityUserId: '1',
            })
            .then((project) => {
              projectId = project.id;
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

  afterEach((done) => {
    testUtil.clearDb(done);
  });

  describe('POST /projects/{projectId}/workstreams/{workStreamId}/works/{workId}/workitems', () => {
    it('should return 403 if user is not authenticated', (done) => {
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}/workitems`)
        .send({ param: body })
        .expect(403, done);
    });

    it('should return 403 for copilot', (done) => {
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}/workitems`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .send({ param: body })
        .expect(403, done);
    });

    it('should return 404 when no work stream with specific workStreamId', (done) => {
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/999/works/${workId}/workitems`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.manager}`,
        })
        .send({ param: body })
        .expect('Content-Type', /json/)
        .expect(404, done);
    });

    it('should return 404 when no work with specific workId', (done) => {
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/999/workitems`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.manager}`,
        })
        .send({ param: body })
        .expect('Content-Type', /json/)
        .expect(404, done);
    });

    it('should return 422 when name not provided', (done) => {
      const reqBody = _.cloneDeep(body);
      delete reqBody.name;
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}/workitems`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.manager}`,
        })
        .send({ param: reqBody })
        .expect('Content-Type', /json/)
        .expect(422, done);
    });

    it('should return 422 when type not provided', (done) => {
      const reqBody = _.cloneDeep(body);
      delete reqBody.type;
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}/workitems`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.manager}`,
        })
        .send({ param: reqBody })
        .expect('Content-Type', /json/)
        .expect(422, done);
    });

    it('should return 422 when estimatedPrice is negative', (done) => {
      const reqBody = _.cloneDeep(body);
      reqBody.estimatedPrice = -20;
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}/workitems`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.manager}`,
        })
        .send({ param: reqBody })
        .expect('Content-Type', /json/)
        .expect(422, done);
    });

    it('should return 422 when actualPrice is negative', (done) => {
      const reqBody = _.cloneDeep(body);
      reqBody.actualPrice = -20;
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}/workitems`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.manager}`,
        })
        .send({ param: reqBody })
        .expect('Content-Type', /json/)
        .expect(422, done);
    });

    it('should return 200 for member', (done) => {
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}/workitems`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.member}`,
        })
        .send({ param: body })
        .expect('Content-Type', /json/)
        .expect(201)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            const resJson = res.body.result.content;
            should.exist(resJson);
            resJson.name.should.be.eql(body.name);
            resJson.type.should.be.eql(body.type);
            resJson.estimatedPrice.should.be.eql(body.estimatedPrice);
            resJson.actualPrice.should.be.eql(body.actualPrice);
            resJson.details.should.be.eql(body.details);
            done();
          }
        });
    });

    it('should return 201 if payload is valid', (done) => {
      request(server)
        .post(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}/workitems`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .send({ param: body })
        .expect('Content-Type', /json/)
        .expect(201)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            const resJson = res.body.result.content;
            should.exist(resJson);
            resJson.name.should.be.eql(body.name);
            resJson.type.should.be.eql(body.type);
            resJson.estimatedPrice.should.be.eql(body.estimatedPrice);
            resJson.actualPrice.should.be.eql(body.actualPrice);
            resJson.details.should.be.eql(body.details);
            done();
          }
        });
    });
  });
});